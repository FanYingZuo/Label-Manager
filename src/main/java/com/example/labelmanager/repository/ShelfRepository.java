package com.example.labelmanager.repository;

import com.example.labelmanager.entity.ShelfEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShelfRepository extends JpaRepository<ShelfEntity, Long> {

    List<ShelfEntity> findAllByOrderBySortOrderAsc();

    Optional<ShelfEntity> findTopByOrderBySortOrderDesc();
}
