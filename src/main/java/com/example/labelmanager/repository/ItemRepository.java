package com.example.labelmanager.repository;

import com.example.labelmanager.entity.ItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ItemRepository extends JpaRepository<ItemEntity, Long> {

    List<ItemEntity> findByShelfIdOrderBySortOrderAsc(Long shelfId);

    long countByShelfId(Long shelfId);

    void deleteByShelfId(Long shelfId);
}
